/*
 *  Copyright (c) 2019-2020 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twin.life)
 */

/*
 * Derived from OutputStream.java
 *  https://android.googlesource.com/platform/libcore (f8dfc9872ecc2f8c3cbc7cb747c2f010f14b3247)
 *  ojluni/src/main/java/java/io/OutputStream.java
 */

/**
 * This abstract class is the superclass of all classes representing
 * an output stream of bytes. An output stream accepts output bytes
 * and sends them to some sink.
 * <p>
 * Applications that need to define a subclass of
 * <code>OutputStream</code> must always provide at least a method
 * that writes one byte of output.
 *
 * @author  Arthur van Hoff
 * @see     java.io.BufferedOutputStream
 * @see     java.io.ByteArrayOutputStream
 * @see     java.io.DataOutputStream
 * @see     java.io.FilterOutputStream
 * @see     java.io.InputStream
 * @see     java.io.OutputStream#write(int)
 * @since   JDK1.0
 * @class
 */
export abstract class OutputStream {
	public write$int(b: number) {
		throw new Error("cannot invoke abstract overloaded method... check your argument(s) type(s)");
	}

	public writeBuffer(b: ArrayBuffer, off: number, len: number) {
		if (len === 0) {
			return;
		}
		for (let i: number = 0; i < len; i++) {
			this.write$int(Buffer.from(b)[off + i]);
		}
	}

	/**
	 * Flushes this output stream and forces any buffered output bytes
	 * to be written out. The general contract of <code>flush</code> is
	 * that calling it is an indication that, if any bytes previously
	 * written have been buffered by the implementation of the output
	 * stream, such bytes should immediately be written to their
	 * intended destination.
	 * <p>
	 * If the intended destination of this stream is an abstraction provided by
	 * the underlying operating system, for example a file, then flushing the
	 * stream guarantees only that bytes previously written to the stream are
	 * passed to the operating system for writing; it does not guarantee that
	 * they are actually written to a physical device such as a disk drive.
	 * <p>
	 * The <code>flush</code> method of <code>OutputStream</code> does nothing.
	 *
	 * @exception  IOException  if an I/O error occurs.
	 */
	public flush() {}

	/**
	 * Closes this output stream and releases any system resources
	 * associated with this stream. The general contract of <code>close</code>
	 * is that it closes the output stream. A closed stream cannot perform
	 * output operations and cannot be reopened.
	 * <p>
	 * The <code>close</code> method of <code>OutputStream</code> does nothing.
	 *
	 * @exception  IOException  if an I/O error occurs.
	 */
	public close() {}
}
